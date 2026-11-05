package com.cbe.cbebirrtransfer;

import android.accessibilityservice.AccessibilityService;
import android.content.Context;
import android.content.Intent;
import android.content.res.ColorStateList;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UssdAccessibilityService extends AccessibilityService {

    public static final String ACTION_RECEIVER_FOUND = "com.cbe.cbebirrtransfer.RECEIVER_FOUND";
    public static final String EXTRA_NAME = "receiver_name";

    public static volatile UssdAccessibilityService instance = null;
    private long lastCapturedTime = 0;
    private WindowManager windowManager = null;
    private View overlayView = null;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    public synchronized void showLoadingOverlay() {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (overlayView != null) return;
                try {
                    windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                    if (windowManager == null) return;

                    WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.MATCH_PARENT,
                        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                        PixelFormat.TRANSLUCENT
                    );
                    params.gravity = Gravity.CENTER;

                    // Root container covering the entire device display
                    FrameLayout root = new FrameLayout(UssdAccessibilityService.this);
                    root.setBackgroundColor(Color.parseColor("#99000000")); // dark overlay
                    root.setClickable(true);
                    root.setFocusable(true);

                    // Authentic CBEBirr loading card
                    LinearLayout card = new LinearLayout(UssdAccessibilityService.this);
                    card.setOrientation(LinearLayout.VERTICAL);
                    card.setGravity(Gravity.CENTER);
                    int pad = (int) (22 * getResources().getDisplayMetrics().density);
                    card.setPadding(pad, pad, pad, pad);

                    GradientDrawable bg = new GradientDrawable();
                    bg.setColor(Color.WHITE);
                    bg.setCornerRadius(18 * getResources().getDisplayMetrics().density);
                    card.setBackground(bg);

                    ProgressBar spinner = new ProgressBar(UssdAccessibilityService.this);
                    spinner.setIndeterminate(true);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        spinner.setIndeterminateTintList(ColorStateList.valueOf(Color.parseColor("#8b278e")));
                    }
                    int spinnerSize = (int) (44 * getResources().getDisplayMetrics().density);
                    card.addView(spinner, new LinearLayout.LayoutParams(spinnerSize, spinnerSize));

                    int cardSize = (int) (96 * getResources().getDisplayMetrics().density);
                    FrameLayout.LayoutParams cardLp = new FrameLayout.LayoutParams(cardSize, cardSize);
                    cardLp.gravity = Gravity.CENTER;
                    root.addView(card, cardLp);

                    overlayView = root;
                    windowManager.addView(overlayView, params);
                } catch (Exception e) {
                    overlayView = null;
                }
            }
        });
    }

    public synchronized void hideLoadingOverlay() {
        mainHandler.post(new Runnable() {
            @Override
            public void run() {
                if (overlayView != null && windowManager != null) {
                    try {
                        windowManager.removeView(overlayView);
                    } catch (Exception ignored) {}
                    overlayView = null;
                }
            }
        });
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // STRICT GUARD 1: Only run if user explicitly triggered USSD inside CBEBirr Plus
        if (!MainActivity.isExpectingUssdResponse) {
            return;
        }

        // Ensure loading overlay is showing so carrier USSD dialog is never visible
        if (overlayView == null) {
            showLoadingOverlay();
        }

        // STRICT GUARD 2: Timeout after 12 seconds from dialing
        if (System.currentTimeMillis() - MainActivity.ussdRequestTimestamp > 12000) {
            MainActivity.isExpectingUssdResponse = false;
            hideLoadingOverlay();
            return;
        }

        // STRICT GUARD 3: Ignore all user apps (Telegram, Hulugram, WhatsApp, Browsers, etc.)
        CharSequence pkgSeq = event.getPackageName();
        if (pkgSeq != null) {
            String pkg = pkgSeq.toString().toLowerCase();
            if (pkg.contains("telegram") ||
                pkg.contains("hulu") ||
                pkg.contains("whatsapp") ||
                pkg.contains("messenger") ||
                pkg.contains("viber") ||
                pkg.contains("signal") ||
                pkg.contains("chrome") ||
                pkg.contains("browser") ||
                pkg.contains("keyboard") ||
                pkg.contains("ime") ||
                pkg.contains("latin") ||
                pkg.contains("swiftkey") ||
                pkg.contains("gboard")) {
                return;
            }
        }

        // Debounce within 1 second
        if (System.currentTimeMillis() - lastCapturedTime < 1000) return;

        AccessibilityNodeInfo source = event.getSource();
        if (source == null) return;

        StringBuilder sb = new StringBuilder();
        if (event.getText() != null) {
            for (CharSequence cs : event.getText()) {
                if (cs != null) sb.append(cs).append(" ");
            }
        }

        extractAndForward(source, sb.toString());
    }

    private void extractAndForward(AccessibilityNodeInfo node, String eventText) {
        if (!MainActivity.isExpectingUssdResponse) return;

        String fullText = getAllText(node) + " " + eventText;
        if (fullText.contains("AccountName") || fullText.contains("Account Name") || fullText.contains("Bank Account")) {
            final String name = parseAccountName(fullText);
            if (name != null && !name.isEmpty()) {
                // RESET FLAG IMMEDIATELY so it never triggers again!
                MainActivity.isExpectingUssdResponse = false;
                lastCapturedTime = System.currentTimeMillis();

                // 1. Dismiss the carrier USSD modal dialog automatically by clicking Cancel or Back
                try {
                    List<AccessibilityNodeInfo> cancelButtons = node.findAccessibilityNodeInfosByText("Cancel");
                    if (cancelButtons != null && !cancelButtons.isEmpty()) {
                        for (AccessibilityNodeInfo btn : cancelButtons) {
                            if (btn.isClickable()) {
                                btn.performAction(AccessibilityNodeInfo.ACTION_CLICK);
                                break;
                            }
                        }
                    }
                } catch (Exception ignored) {}

                performGlobalAction(GLOBAL_ACTION_BACK);

                // 2. Bring MainActivity back to foreground
                try {
                    Intent bringToFront = new Intent(UssdAccessibilityService.this, MainActivity.class);
                    bringToFront.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(bringToFront);
                } catch (Exception ignored) {}

                // 3. Inject receiver name, and only hide overlay after USSD runner has completely closed
                mainHandler.postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        // Deliver receiver name
                        Intent broadcast = new Intent(ACTION_RECEIVER_FOUND);
                        broadcast.setPackage(getPackageName());
                        broadcast.putExtra(EXTRA_NAME, name);
                        sendBroadcast(broadcast);

                        if (MainActivity.currentInstance != null) {
                            MainActivity.currentInstance.setReceiverNameFromService(name);
                        }

                        // Wait for USSD runner dialog to be completely gone and MainActivity in full view
                        mainHandler.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                hideLoadingOverlay();
                            }
                        }, 500);
                    }
                }, 700);
            }
        }
    }

    private String getAllText(AccessibilityNodeInfo node) {
        if (node == null) return "";
        StringBuilder sb = new StringBuilder();
        CharSequence text = node.getText();
        if (text != null && text.length() > 0) {
            sb.append(text).append("\n");
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            AccessibilityNodeInfo child = node.getChild(i);
            if (child != null) {
                sb.append(getAllText(child)).append("\n");
            }
        }
        return sb.toString();
    }

    public static String parseAccountName(String text) {
        if (text == null) return "";

        // Pattern 1: "AccountName : FOZIA MOSSA  MOHAMMED"
        Pattern p1 = Pattern.compile("(?i)Account\\s*Name\\s*:\\s*([A-Za-z\\u1200-\\u137F\\s]+?)(?:\\r?\\n|Bank\\s*Account|1\\s*OK|0\\s*Cancel|$)");
        Matcher m1 = p1.matcher(text);
        if (m1.find()) {
            String name = m1.group(1);
            if (name != null && name.trim().length() > 2) {
                return name.trim().replaceAll("\\s+", " ");
            }
        }

        Pattern p2 = Pattern.compile("(?i)(?:Transfer\\s+to|ወደ|ለ)\\s+([A-Za-z\\u1200-\\u137F\\s]+?)(?:\\?|\\.|\\r?\\n|\\s*\\d:|$)");
        Matcher m2 = p2.matcher(text);
        if (m2.find()) {
            String name = m2.group(1);
            if (name != null && name.trim().length() > 2) {
                return name.trim().replaceAll("\\s+", " ");
            }
        }

        return "";
    }

    @Override
    public void onInterrupt() {}

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }
}
