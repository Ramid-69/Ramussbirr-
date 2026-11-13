package com.cbebirr.messages.cbe

import android.Manifest
import android.annotation.SuppressLint
import android.app.role.RoleManager
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.ContactsContract
import android.provider.Settings
import android.provider.Telephony
import android.telephony.SmsManager
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.lang.ref.WeakReference

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var askedNotifThisLaunch = false
    private var askedRoleThisLaunch = false
    private var askedSmsPermsThisLaunch = false
    private var permissionFlowRunning = false

    private val notifPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        permissionFlowRunning = false
        continueStartupPermissionFlow()
    }

    private val smsRoleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        permissionFlowRunning = false
        continueStartupPermissionFlow()
    }

    private val smsPermsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        permissionFlowRunning = false
        refreshWebViewMessages()
        ensureBackgroundSyncService()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.WHITE
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }

        NotificationHelper.ensureChannels(this)

        webView = WebView(this).apply {
            setBackgroundColor(Color.WHITE)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true
        }

        val bridge = AndroidSMSBridge()
        webView.addJavascriptInterface(bridge, "AndroidSMSBridge")
        webView.addJavascriptInterface(bridge, "Android")

        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?
            ): WebResourceResponse? {
                val url = request?.url ?: return super.shouldInterceptRequest(view, request)
                val host = url.host ?: ""
                if (host == "appassets.androidplatform.net" || host == "localhost" || host == "127.0.0.1") {
                    val assetResponse = openLocalAssetResponse(url.path ?: "/")
                    if (assetResponse != null) return assetResponse
                }
                return super.shouldInterceptRequest(view, request)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                handleComposeIntent(intent)
                refreshWebViewMessages()
            }
        }

        setContentView(webView)
        activeInstance = WeakReference(this)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript(
                    "(function(){ if(document.getElementById('receipt-modal')?.classList.contains('open')){ closeReceiptModal(); return 'handled'; } if(document.getElementById('chat-view')?.classList.contains('active')){ closeChat(); return 'handled'; } if(document.getElementById('new-conv-view')?.classList.contains('active')){ closeNewConv(); return 'handled'; } return 'exit'; })()"
                ) { res ->
                    if (res == "\"exit\"" || res == "null") {
                        finish()
                    }
                }
            }
        })

        // Direct offline asset stream load to guarantee zero white screen
        webView.loadUrl("https://appassets.androidplatform.net/assets/messages.html")

        ensureBackgroundSyncService()
        continueStartupPermissionFlow()
    }

    override fun onResume() {
        super.onResume()
        activeInstance = WeakReference(this)
        NotificationHelper.ensureChannels(this)
        ensureBackgroundSyncService()
        refreshWebViewMessages()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleComposeIntent(intent)
        refreshWebViewMessages()
    }

    override fun onDestroy() {
        if (activeInstance?.get() === this) {
            activeInstance = null
        }
        super.onDestroy()
    }

    private fun openLocalAssetResponse(rawPath: String): WebResourceResponse? {
        var cleanPath = rawPath.trimStart('/')
        if (cleanPath.isEmpty() || cleanPath == "index.html") {
            cleanPath = "messages.html"
        } else if (cleanPath.startsWith("assets/")) {
            cleanPath = cleanPath.removePrefix("assets/")
        }

        val candidates = listOf(cleanPath, "dist/$cleanPath", "messages.html")
        for (candidate in candidates) {
            try {
                val stream: InputStream = assets.open(candidate)
                val mime = guessMimeType(candidate)
                return WebResourceResponse(mime, "UTF-8", stream)
            } catch (_: Throwable) {
            }
        }
        return null
    }

    private fun guessMimeType(path: String): String {
        val lower = path.lowercase()
        return when {
            lower.endsWith(".html") || lower.endsWith(".htm") -> "text/html"
            lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript"
            lower.endsWith(".css") -> "text/css"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
            lower.endsWith(".svg") -> "image/svg+xml"
            lower.endsWith(".json") -> "application/json"
            lower.endsWith(".woff2") -> "font/woff2"
            else -> "application/octet-stream"
        }
    }

    private fun continueStartupPermissionFlow() {
        if (permissionFlowRunning) return

        // Step 1: Android 13+ POST_NOTIFICATIONS requested alone first so system prompt isn't suppressed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            !askedNotifThisLaunch &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            askedNotifThisLaunch = true
            permissionFlowRunning = true
            notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }

        // Step 2: RoleManager.ROLE_SMS so OS recognizes app as Default SMS App
        if (!askedRoleThisLaunch && !LocalMessageStore.isDefaultSmsApp(this)) {
            askedRoleThisLaunch = true
            launchDefaultSmsRolePrompt()
            return
        }

        // Step 3: Runtime SMS + Contacts permissions
        if (!askedSmsPermsThisLaunch) {
            val missing = getMissingSmsAndContactPermissions()
            if (missing.isNotEmpty()) {
                askedSmsPermsThisLaunch = true
                permissionFlowRunning = true
                smsPermsLauncher.launch(missing.toTypedArray())
            }
        }
    }

    private fun getMissingSmsAndContactPermissions(): List<String> {
        val needed = listOf(
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_CONTACTS
        )
        return needed.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
    }

    private fun launchDefaultSmsRolePrompt() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val rm = getSystemService(RoleManager::class.java)
                if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_SMS) && !rm.isRoleHeld(RoleManager.ROLE_SMS)) {
                    permissionFlowRunning = true
                    smsRoleLauncher.launch(rm.createRequestRoleIntent(RoleManager.ROLE_SMS))
                    return
                }
            } else {
                if (!LocalMessageStore.isDefaultSmsApp(this)) {
                    val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
                        putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, packageName)
                    }
                    permissionFlowRunning = true
                    smsRoleLauncher.launch(intent)
                    return
                }
            }
        } catch (_: Throwable) {
            permissionFlowRunning = false
        }
    }

    private fun ensureBackgroundSyncService() {
        try {
            val svcIntent = Intent(this, SmsSyncService::class.java)
            ContextCompat.startForegroundService(this, svcIntent)
        } catch (_: Throwable) {
        }
    }

    private fun handleComposeIntent(intent: Intent?) {
        if (intent == null) return
        val action = intent.action ?: return
        if (action == Intent.ACTION_SENDTO || action == Intent.ACTION_SEND || action == Intent.ACTION_VIEW) {
            val rawUri = intent.data?.schemeSpecificPart ?: ""
            val recipient = rawUri.substringBefore("?").trim()
            val body = intent.getStringExtra("sms_body")
                ?: intent.getStringExtra(Intent.EXTRA_TEXT)
                ?: ""
            if (recipient.isNotBlank() || body.isNotBlank()) {
                val payload = JSONObject().apply {
                    put("recipient", recipient)
                    put("body", body)
                }.toString()
                webView.post {
                    webView.evaluateJavascript(
                        "if(window.openComposePrefilled){window.openComposePrefilled($payload);}",
                        null
                    )
                }
            }
        }
    }

    private fun refreshWebViewMessages() {
        webView.post {
            webView.evaluateJavascript(
                "if(window.onNativeResume){window.onNativeResume();} if(window.updatePermissionBanner){window.updatePermissionBanner();}",
                null
            )
        }
    }

    inner class AndroidSMSBridge {

        @JavascriptInterface
        fun getAllSms(limit: Int): String {
            val maxItems = if (limit > 0) limit else 150
            val arr = JSONArray()

            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                return arr.toString()
            }

            try {
                val projection = arrayOf(
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.TYPE,
                    Telephony.Sms.READ
                )
                contentResolver.query(
                    Telephony.Sms.CONTENT_URI,
                    projection,
                    null,
                    null,
                    "${Telephony.Sms.DATE} DESC LIMIT $maxItems"
                )?.use { cursor ->
                    val idxId = cursor.getColumnIndex(Telephony.Sms._ID)
                    val idxAddr = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
                    val idxBody = cursor.getColumnIndex(Telephony.Sms.BODY)
                    val idxDate = cursor.getColumnIndex(Telephony.Sms.DATE)
                    val idxType = cursor.getColumnIndex(Telephony.Sms.TYPE)
                    val idxRead = cursor.getColumnIndex(Telephony.Sms.READ)

                    while (cursor.moveToNext()) {
                        val id = if (idxId >= 0) cursor.getString(idxId) else ""
                        val addr = (if (idxAddr >= 0) cursor.getString(idxAddr) else "") ?: "Messages"
                        val body = (if (idxBody >= 0) cursor.getString(idxBody) else "") ?: ""
                        val dateMs = if (idxDate >= 0) cursor.getLong(idxDate) else System.currentTimeMillis()
                        val typeInt = if (idxType >= 0) cursor.getInt(idxType) else Telephony.Sms.MESSAGE_TYPE_INBOX
                        val isRead = if (idxRead >= 0) cursor.getInt(idxRead) == 1 else true
                        val typeStr = if (typeInt == Telephony.Sms.MESSAGE_TYPE_SENT) "sent" else "inbox"

                        val obj = JSONObject().apply {
                            put("id", id)
                            put("address", addr)
                            put("sender", addr)
                            put("senderName", addr)
                            put("body", body)
                            put("text", body)
                            put("date", dateMs)
                            put("type", typeStr)
                            put("read", isRead)
                            put("status", if (isRead) "read" else "unread")
                            put("isOutgoing", typeStr == "sent")
                        }
                        arr.put(obj)
                    }
                }
            } catch (_: Throwable) {
            }
            return arr.toString()
        }

        @JavascriptInterface
        fun sendSms(address: String, body: String): Boolean {
            val cleanAddr = address.trim()
            val cleanBody = body.trim()
            if (cleanAddr.isEmpty() || cleanBody.isEmpty()) return false

            return try {
                val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    getSystemService(SmsManager::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    SmsManager.getDefault()
                }
                val parts = smsManager.divideMessage(cleanBody)
                if (parts.size > 1) {
                    smsManager.sendMultipartTextMessage(cleanAddr, null, parts, null, null)
                } else {
                    smsManager.sendTextMessage(cleanAddr, null, cleanBody, null, null)
                }

                // Insert into Sent database (isolated try/catch)
                try {
                    val values = ContentValues().apply {
                        put(Telephony.Sms.ADDRESS, cleanAddr)
                        put(Telephony.Sms.BODY, cleanBody)
                        put(Telephony.Sms.DATE, System.currentTimeMillis())
                        put(Telephony.Sms.READ, 1)
                        put(Telephony.Sms.SEEN, 1)
                        put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_SENT)
                    }
                    contentResolver.insert(Telephony.Sms.Sent.CONTENT_URI, values)
                } catch (_: Throwable) {
                }

                LocalMessageStore.saveIncomingMessage(
                    context = this@MainActivity,
                    id = "sent_${System.currentTimeMillis()}",
                    address = cleanAddr,
                    body = cleanBody,
                    dateMs = System.currentTimeMillis(),
                    type = "sent",
                    isBank = false
                )
                true
            } catch (_: Throwable) {
                false
            }
        }

        @JavascriptInterface
        fun getAllContacts(): String {
            val arr = JSONArray()
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
                return arr.toString()
            }

            val seenNumbers = hashSetOf<String>()
            try {
                val projection = arrayOf(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                )
                contentResolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    projection,
                    null,
                    null,
                    "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
                )?.use { cursor ->
                    val idxName = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val idxNum = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    while (cursor.moveToNext()) {
                        val name = (if (idxName >= 0) cursor.getString(idxName) else "") ?: ""
                        val num = (if (idxNum >= 0) cursor.getString(idxNum) else "")?.trim() ?: ""
                        if (num.isNotEmpty() && seenNumbers.add(num.replace(" ", ""))) {
                            arr.put(JSONObject().apply {
                                put("id", num)
                                put("name", name.ifBlank { num })
                                put("phone", num)
                                put("number", num)
                            })
                        }
                    }
                }
            } catch (_: Throwable) {
            }
            return arr.toString()
        }

        @JavascriptInterface
        fun getSavedMessages(): String {
            return LocalMessageStore.getSavedMessagesJson(this@MainActivity)
        }

        @JavascriptInterface
        fun clearSavedMessages() {
            LocalMessageStore.clearSavedMessages(this@MainActivity)
        }

        @JavascriptInterface
        fun markAllRead() {
            LocalMessageStore.markAllSavedRead(this@MainActivity)
        }

        @JavascriptInterface
        fun isDefaultSmsApp(): Boolean = LocalMessageStore.isDefaultSmsApp(this@MainActivity)

        @JavascriptInterface
        fun isDefaultSms(): Boolean = LocalMessageStore.isDefaultSmsApp(this@MainActivity)

        @JavascriptInterface
        fun requestDefaultSmsApp() {
            runOnUiThread { launchDefaultSmsRolePrompt() }
        }

        @JavascriptInterface
        fun requestDefaultSms() {
            runOnUiThread { launchDefaultSmsRolePrompt() }
        }

        @JavascriptInterface
        fun requestNotificationPermission() {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        if (shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS) || !askedNotifThisLaunch) {
                            askedNotifThisLaunch = true
                            notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                        } else {
                            openNotificationSettings()
                        }
                    } else if (!NotificationHelper.hasNotificationPermission(this@MainActivity)) {
                        openNotificationSettings()
                    }
                } else if (!NotificationHelper.hasNotificationPermission(this@MainActivity)) {
                    openNotificationSettings()
                }
            }
        }

        @JavascriptInterface
        fun requestPermissions() {
            runOnUiThread {
                askedNotifThisLaunch = false
                askedRoleThisLaunch = false
                askedSmsPermsThisLaunch = false
                permissionFlowRunning = false
                continueStartupPermissionFlow()
            }
        }

        @JavascriptInterface
        fun hasPermissions(): Boolean {
            val notifOk = NotificationHelper.hasNotificationPermission(this@MainActivity)
            val smsOk = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
            return notifOk && smsOk
        }

        @JavascriptInterface
        fun getPermissionDetails(): String {
            val notifOk = NotificationHelper.hasNotificationPermission(this@MainActivity)
            val smsOk = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED &&
                ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED
            val contactsOk = ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
            val defaultOk = LocalMessageStore.isDefaultSmsApp(this@MainActivity)

            return JSONObject().apply {
                put("notifications", notifOk)
                put("sms", smsOk)
                put("contacts", contactsOk)
                put("defaultSms", defaultOk)
            }.toString()
        }

        @JavascriptInterface
        fun openNotificationSettings() {
            runOnUiThread {
                try {
                    val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                            putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                        }
                    } else {
                        Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.fromParts("package", packageName, null)
                        }
                    }
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(intent)
                } catch (_: Throwable) {
                    openAppSettings()
                }
            }
        }

        @JavascriptInterface
        fun openAppSettings() {
            runOnUiThread {
                try {
                    val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.fromParts("package", packageName, null)
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (_: Throwable) {
                }
            }
        }

        @JavascriptInterface
        fun playSystemNotificationSound() {
            NotificationHelper.playSystemNotificationSound(this@MainActivity)
        }

        @JavascriptInterface
        fun triggerSystemVibration() {
            NotificationHelper.triggerSystemVibration(this@MainActivity)
        }

        @JavascriptInterface
        fun notify(title: String, body: String) {
            NotificationHelper.showIncomingMessageNotification(
                context = this@MainActivity,
                sender = title,
                body = body,
                playSoundAndVibrate = true
            )
        }

        @JavascriptInterface
        fun dialNumber(phone: String) {
            runOnUiThread {
                try {
                    val dialIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(phone.trim())}"))
                    startActivity(dialIntent)
                } catch (_: Throwable) {
                }
            }
        }
    }

    companion object {
        @Volatile
        private var activeInstance: WeakReference<MainActivity>? = null

        fun dispatchIncomingSms(jsonPayload: String) {
            val activity = activeInstance?.get() ?: return
            activity.runOnUiThread {
                try {
                    val quoted = JSONObject.quote(jsonPayload)
                    activity.webView.evaluateJavascript(
                        "if(window.onNativeSmsReceived){window.onNativeSmsReceived(JSON.parse($quoted));}",
                        null
                    )
                } catch (_: Throwable) {
                }
            }
        }
    }
}
