package com.ramid.messages

import android.Manifest
import android.app.role.RoleManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.ContactsContract
import android.provider.Telephony
import android.telephony.SmsManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.lang.ref.WeakReference

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    companion object {
        private var instanceRef: WeakReference<MainActivity>? = null

        fun dispatchIncomingSms(jsonString: String) {
            instanceRef?.get()?.runOnUiThread {
                instanceRef?.get()?.webView?.evaluateJavascript(
                    "if (window.onNativeSmsReceived) { window.onNativeSmsReceived(${JSONObject.quote(jsonString)}); }",
                    null
                )
            }
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        val granted = perms.values.all { it }
        if (granted) {
            webView.evaluateJavascript("if (window.onPermissionsGranted) { window.onPermissionsGranted(); }", null)
        }
    }

    private val roleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { _ ->
        if (isDefaultSmsApp()) {
            Toast.makeText(this, "Messages is now your default SMS app!", Toast.LENGTH_SHORT).show()
            webView.evaluateJavascript("if (window.onDefaultSmsGranted) { window.onDefaultSmsGranted(); }", null)
        }
        checkAndRequestPermissions()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instanceRef = WeakReference(this)

        webView = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F4F6F9"))
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                allowFileAccess = true
                allowContentAccess = true
                allowFileAccessFromFileURLs = true
                allowUniversalAccessFromFileURLs = true
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    val url = request.url
                    val host = url.host ?: ""
                    val path = url.path ?: ""

                    if (host == "appassets.androidplatform.net" || host == "localhost" || host.isEmpty()) {
                        try {
                            val cleanPath = when {
                                path.isEmpty() || path == "/" || path == "/index.html" -> "index.html"
                                path.startsWith("/dist/") -> path.removePrefix("/dist/")
                                path.startsWith("/") -> path.substring(1)
                                else -> path
                            }

                            val inputStream = try {
                                assets.open(cleanPath)
                            } catch (e: Exception) {
                                try {
                                    assets.open("dist/$cleanPath")
                                } catch (e2: Exception) {
                                    if (cleanPath.endsWith(".html") || !cleanPath.contains(".")) {
                                        assets.open("index.html")
                                    } else return null
                                }
                            }

                            val mimeType = when {
                                cleanPath.endsWith(".html") -> "text/html"
                                cleanPath.endsWith(".js") || cleanPath.endsWith(".mjs") -> "application/javascript"
                                cleanPath.endsWith(".css") -> "text/css"
                                cleanPath.endsWith(".svg") -> "image/svg+xml"
                                cleanPath.endsWith(".json") -> "application/json"
                                else -> "application/octet-stream"
                            }

                            return WebResourceResponse(mimeType, "UTF-8", inputStream)
                        } catch (ignored: Exception) {}
                    }
                    return super.shouldInterceptRequest(view, request)
                }
            }

            addJavascriptInterface(AndroidSMSBridge(), "AndroidSMSBridge")
        }

        setContentView(webView)

        if (!isDefaultSmsApp()) {
            requestDefaultApp()
        } else {
            checkAndRequestPermissions()
        }

        webView.loadUrl("https://appassets.androidplatform.net/index.html")
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_CONTACTS
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val needed = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (needed.isNotEmpty()) {
            permissionLauncher.launch(needed.toTypedArray())
        }
    }

    private fun isDefaultSmsApp(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(RoleManager::class.java)
            roleManager?.isRoleHeld(RoleManager.ROLE_SMS) == true
        } else {
            packageName == Telephony.Sms.getDefaultSmsPackage(this)
        }
    }

    private fun requestDefaultApp() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = getSystemService(RoleManager::class.java)
                if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_SMS)) {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_SMS)
                    roleLauncher.launch(intent)
                    return
                }
            }
            val intent = Intent(Telephony.Sms.Intents.ACTION_CHANGE_DEFAULT).apply {
                putExtra(Telephony.Sms.Intents.EXTRA_PACKAGE_NAME, packageName)
            }
            startActivity(intent)
        } catch (e: Exception) {
            checkAndRequestPermissions()
        }
    }

    inner class AndroidSMSBridge {

        @JavascriptInterface
        fun isDefaultSmsApp(): Boolean = this@MainActivity.isDefaultSmsApp()

        @JavascriptInterface
        fun requestDefaultSmsApp() {
            runOnUiThread { this@MainActivity.requestDefaultApp() }
        }

        @JavascriptInterface
        fun requestPermissions() {
            runOnUiThread { this@MainActivity.checkAndRequestPermissions() }
        }

        @JavascriptInterface
        fun hasPermissions(): Boolean {
            return ContextCompat.checkSelfPermission(
                this@MainActivity,
                Manifest.permission.READ_SMS
            ) == PackageManager.PERMISSION_GRANTED
        }

        @JavascriptInterface
        fun getAllSms(limit: Int): String {
            val smsArray = JSONArray()
            val uri = Uri.parse("content://sms/")
            val projection = arrayOf("_id", "address", "body", "date", "type", "read")

            val cursor = contentResolver.query(
                uri,
                projection,
                null,
                null,
                "date DESC" + (if (limit > 0) " LIMIT $limit" else "")
            )

            cursor?.use {
                val idIdx = it.getColumnIndex("_id")
                val addressIdx = it.getColumnIndex("address")
                val bodyIdx = it.getColumnIndex("body")
                val dateIdx = it.getColumnIndex("date")
                val typeIdx = it.getColumnIndex("type")
                val readIdx = it.getColumnIndex("read")

                while (it.moveToNext()) {
                    val obj = JSONObject().apply {
                        put("id", it.getString(idIdx))
                        put("address", it.getString(addressIdx) ?: "Unknown")
                        put("body", it.getString(bodyIdx) ?: "")
                        put("date", it.getLong(dateIdx))
                        put("type", if (it.getInt(typeIdx) == 2) "sent" else "inbox")
                        put("read", it.getInt(readIdx) == 1)
                    }
                    smsArray.put(obj)
                }
            }
            return smsArray.toString()
        }

        @JavascriptInterface
        fun sendSms(address: String, body: String): Boolean {
            return try {
                val smsManager: SmsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    getSystemService(SmsManager::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    SmsManager.getDefault()
                }

                val parts = smsManager.divideMessage(body)
                if (parts.size > 1) {
                    smsManager.sendMultipartTextMessage(address, null, parts, null, null)
                } else {
                    smsManager.sendTextMessage(address, null, body, null, null)
                }

                try {
                    val values = ContentValues().apply {
                        put(Telephony.Sms.ADDRESS, address)
                        put(Telephony.Sms.BODY, body)
                        put(Telephony.Sms.DATE, System.currentTimeMillis())
                        put(Telephony.Sms.READ, 1)
                        put(Telephony.Sms.TYPE, Telephony.Sms.MESSAGE_TYPE_SENT)
                    }
                    contentResolver.insert(Telephony.Sms.Sent.CONTENT_URI, values)
                } catch (ignored: Exception) {}

                true
            } catch (e: Exception) {
                false
            }
        }

        @JavascriptInterface
        fun playSystemNotificationSound() {
            try {
                val uri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)
                val ringtone = android.media.RingtoneManager.getRingtone(applicationContext, uri)
                ringtone?.play()
            } catch (ignored: Exception) {}
        }

        @JavascriptInterface
        fun triggerSystemVibration() {
            try {
                val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? android.os.Vibrator
                val pattern = longArrayOf(0, 180, 80, 240)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator?.vibrate(android.os.VibrationEffect.createWaveform(pattern, -1))
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(pattern, -1)
                }
            } catch (ignored: Exception) {}
        }

        @JavascriptInterface
        fun getAllContacts(): String {
            val contactsArray = JSONArray()
            return try {
                val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI
                val cursor = contentResolver.query(
                    uri,
                    arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER),
                    null,
                    null,
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME + " ASC"
                )
                cursor?.use {
                    val nameIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    val idIdx = it.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                    while (it.moveToNext()) {
                        val obj = JSONObject().apply {
                            put("id", it.getString(idIdx))
                            put("name", it.getString(nameIdx) ?: "Unknown")
                            put("phone", it.getString(numIdx) ?: "")
                        }
                        contactsArray.put(obj)
                    }
                }
                contactsArray.toString()
            } catch (e: Exception) { "[]" }
        }
    }
}
