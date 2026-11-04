package com.cbe.cbebirrtransfer;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class UssdAccessibilityService extends AccessibilityService {

    public static final String ACTION_RECEIVER_FOUND = "com.cbe.cbebirrtransfer.RECEIVER_FOUND";
    public static final String EXTRA_NAME = "receiver_name";

    public static UssdAccessibilityService instance = null;
    private long lastCapturedTime = 0;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // STRICT GUARD 1: Only run if user explicitly triggered USSD inside CBEBirr Plus
        if (!MainActivity.isExpectingUssdResponse) {
            return;
        }

        // STRICT GUARD 2: Timeout after 12 seconds from dialing
        if (System.currentTimeMillis() - MainActivity.ussdRequestTimestamp > 12000) {
            MainActivity.isExpectingUssdResponse = false;
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

                // 1. Send broadcast to MainActivity with receiver name
                Intent broadcast = new Intent(ACTION_RECEIVER_FOUND);
                broadcast.setPackage(getPackageName());
                broadcast.putExtra(EXTRA_NAME, name);
                sendBroadcast(broadcast);

                // 2. Dismiss the carrier USSD modal dialog automatically by clicking Cancel or Back
                try {
                    java.util.List<AccessibilityNodeInfo> cancelButtons = node.findAccessibilityNodeInfosByText("Cancel");
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

                // 3. Bring MainActivity back to foreground ONLY after USSD
                try {
                    Intent bringToFront = new Intent(UssdAccessibilityService.this, MainActivity.class);
                    bringToFront.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    startActivity(bringToFront);
                } catch (Exception e) {
                    // ignore
                }
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
