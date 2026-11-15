package com.cbebirr.messages.cbe

import android.Manifest
import android.annotation.SuppressLint
import android.app.role.RoleManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
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

    private val contactsPermLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        permissionFlowRunning = false
        webView.post {
            webView.evaluateJavascript(
                "if(window.onNativeContactsPermissionResult){window.onNativeContactsPermissionResult(${if (granted) "true" else "false"});}",
                null
            )
        }
        refreshWebViewMessages()
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
                    "(function(){ if(document.getElementById('receipt-modal')?.classList.contains('open')){ closeReceiptModal(); return 'handled'; } if(document.getElementById('full-msg-view')?.classList.contains('active')){ closeFullMessageView(); return 'handled'; } if(document.getElementById('confirm-modal')?.classList.contains('open')){ closeConfirmModal(); return 'handled'; } if(document.getElementById('msg-action-sheet')?.classList.contains('open')){ closeMsgActionSheet(); return 'handled'; } if(document.getElementById('chat-view')?.classList.contains('active')){ closeChat(); return 'handled'; } if(document.getElementById('new-conv-view')?.classList.contains('active')){ closeNewConv(); return 'handled'; } if(typeof currentBottomTab !== 'undefined' && currentBottomTab === 'contacts'){ switchBottomTab('conversations'); return 'handled'; } return 'exit'; })()"
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
            val maxItems = if (limit > 0) limit else 400
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
                            put("source", "sim")
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
                    isBank = false,
                    source = "sim"
                )
                true
            } catch (_: Throwable) {
                false
            }
        }

        private fun normalizeContactNumber(raw: String): String {
            val digits = raw.filter { it.isDigit() }
            return if (digits.length >= 9) digits.takeLast(9) else raw.trim().lowercase()
        }

        @JavascriptInterface
        fun getAllContacts(): String {
            val arr = JSONArray()
            if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS) != PackageManager.PERMISSION_GRANTED) {
                return arr.toString()
            }

            val seenPairs = hashSetOf<String>()
            try {
                val projection = arrayOf(
                    ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER,
                    ContactsContract.CommonDataKinds.Phone.TYPE,
                    ContactsContract.CommonDataKinds.Phone.LABEL
                )
                contentResolver.query(
                    ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                    projection,
                    null,
                    null,
                    "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} COLLATE NOCASE ASC"
                )?.use { cursor ->
                    val idxContactId = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    val idxName = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val idxNum = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val idxType = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.TYPE)
                    val idxLabel = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.LABEL)
                    while (cursor.moveToNext()) {
                        val contactId = if (idxContactId >= 0) cursor.getString(idxContactId) ?: "" else ""
                        val name = (if (idxName >= 0) cursor.getString(idxName) else "")?.trim() ?: ""
                        val num = (if (idxNum >= 0) cursor.getString(idxNum) else "")?.trim() ?: ""
                        if (num.isEmpty()) continue
                        val normKey = normalizeContactNumber(num)
                        val dedupeKey = "${name.lowercase()}|$normKey"
                        if (!seenPairs.add(dedupeKey)) continue

                        val phoneType = if (idxType >= 0) cursor.getInt(idxType) else ContactsContract.CommonDataKinds.Phone.TYPE_MOBILE
                        val customLabel = if (idxLabel >= 0) cursor.getString(idxLabel) else null
                        val typeLabel = try {
                            ContactsContract.CommonDataKinds.Phone.getTypeLabel(resources, phoneType, customLabel).toString()
                        } catch (_: Throwable) {
                            "Mobile"
                        }

                        arr.put(JSONObject().apply {
                            put("id", if (contactId.isNotEmpty()) "${contactId}_$normKey" else normKey)
                            put("name", name.ifBlank { num })
                            put("phone", num)
                            put("number", num)
                            put("normalized", normKey)
                            put("label", typeLabel)
                        })
                    }
                }
            } catch (_: Throwable) {
            }
            return arr.toString()
        }

        @JavascriptInterface
        fun requestContactsPermission() {
            runOnUiThread {
                if (ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED) {
                    webView.evaluateJavascript(
                        "if(window.onNativeContactsPermissionResult){window.onNativeContactsPermissionResult(true);}",
                        null
                    )
                    return@runOnUiThread
                }
                if (shouldShowRequestPermissionRationale(Manifest.permission.READ_CONTACTS) || !askedSmsPermsThisLaunch) {
                    askedSmsPermsThisLaunch = true
                    contactsPermLauncher.launch(Manifest.permission.READ_CONTACTS)
                } else {
                    contactsPermLauncher.launch(Manifest.permission.READ_CONTACTS)
                }
            }
        }

        @JavascriptInterface
        fun deleteMessage(id: String, address: String, body: String, dateMs: Long, source: String): Boolean {
            val cleanId = id.trim()
            val cleanBody = body.trim()
            val cleanSource = source.trim().ifBlank { "sim" }
            val removedLocal = LocalMessageStore.deleteMessage(
                context = this@MainActivity,
                id = cleanId,
                address = address,
                body = cleanBody,
                dateMs = dateMs,
                source = cleanSource
            )
            var removedProvider = false
            if (cleanSource != "app") {
                try {
                    val numericId = cleanId.toLongOrNull()
                    if (numericId != null) {
                        val rows = contentResolver.delete(
                            Telephony.Sms.CONTENT_URI,
                            "${Telephony.Sms._ID} = ?",
                            arrayOf(cleanId)
                        )
                        if (rows > 0) removedProvider = true
                    }
                    if (!removedProvider && cleanBody.isNotEmpty() && dateMs > 0L) {
                        val minDate = dateMs - 5000L
                        val maxDate = dateMs + 5000L
                        val toDeleteIds = mutableListOf<String>()
                        contentResolver.query(
                            Telephony.Sms.CONTENT_URI,
                            arrayOf(Telephony.Sms._ID, Telephony.Sms.BODY),
                            "${Telephony.Sms.DATE} >= ? AND ${Telephony.Sms.DATE} <= ?",
                            arrayOf(minDate.toString(), maxDate.toString()),
                            null
                        )?.use { c ->
                            val idxId = c.getColumnIndex(Telephony.Sms._ID)
                            val idxBody = c.getColumnIndex(Telephony.Sms.BODY)
                            while (c.moveToNext()) {
                                val rowId = if (idxId >= 0) c.getString(idxId) else continue
                                val rowBody = (if (idxBody >= 0) c.getString(idxBody) else "")?.trim() ?: ""
                                if (rowBody == cleanBody) {
                                    toDeleteIds.add(rowId)
                                }
                            }
                        }
                        for (rowId in toDeleteIds) {
                            val rows = contentResolver.delete(
                                Telephony.Sms.CONTENT_URI,
                                "${Telephony.Sms._ID} = ?",
                                arrayOf(rowId)
                            )
                            if (rows > 0) removedProvider = true
                        }
                    }
                } catch (_: Throwable) {
                }
            }
            return removedLocal || removedProvider
        }

        @JavascriptInterface
        fun deleteConversation(address: String, source: String): Boolean {
            val cleanAddr = address.trim()
            val cleanSource = source.trim().ifBlank { "sim" }
            val removedLocal = LocalMessageStore.deleteConversation(
                context = this@MainActivity,
                address = cleanAddr,
                source = cleanSource
            )
            var removedProvider = false
            if (cleanSource != "app" && cleanAddr.isNotEmpty()) {
                try {
                    val targetNorm = normalizeContactNumber(cleanAddr)
                    val targetLower = cleanAddr.lowercase()
                    val isPhoneNum = cleanAddr.count { it.isDigit() } >= 7
                    val toDeleteIds = mutableListOf<String>()

                    contentResolver.query(
                        Telephony.Sms.CONTENT_URI,
                        arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS),
                        null,
                        null,
                        null
                    )?.use { c ->
                        val idxId = c.getColumnIndex(Telephony.Sms._ID)
                        val idxAddr = c.getColumnIndex(Telephony.Sms.ADDRESS)
                        while (c.moveToNext()) {
                            val rowId = if (idxId >= 0) c.getString(idxId) else continue
                            val rowAddr = (if (idxAddr >= 0) c.getString(idxAddr) else "")?.trim() ?: ""
                            val matches = if (isPhoneNum) {
                                rowAddr.equals(cleanAddr, ignoreCase = true) ||
                                    (targetNorm.isNotEmpty() && normalizeContactNumber(rowAddr) == targetNorm)
                            } else {
                                rowAddr.lowercase() == targetLower
                            }
                            if (matches) {
                                toDeleteIds.add(rowId)
                            }
                        }
                    }
                    for (rowId in toDeleteIds) {
                        val rows = contentResolver.delete(
                            Telephony.Sms.CONTENT_URI,
                            "${Telephony.Sms._ID} = ?",
                            arrayOf(rowId)
                        )
                        if (rows > 0) removedProvider = true
                    }
                } catch (_: Throwable) {
                }
            }
            return removedLocal || removedProvider
        }

        @JavascriptInterface
        fun shareText(text: String) {
            val clean = text.trim()
            if (clean.isEmpty()) return
            runOnUiThread {
                try {
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, clean)
                    }
                    val chooser = Intent.createChooser(sendIntent, "Share message")
                    chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    startActivity(chooser)
                } catch (_: Throwable) {
                }
            }
        }

        @JavascriptInterface
        fun copyToClipboard(text: String): Boolean {
            return try {
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return false
                cm.setPrimaryClip(ClipData.newPlainText("Message", text))
                true
            } catch (_: Throwable) {
                false
            }
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
