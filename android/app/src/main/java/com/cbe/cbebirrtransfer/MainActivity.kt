package com.cbe.cbebirrtransfer

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telephony.TelephonyManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.net.URLDecoder
import java.util.regex.Pattern

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val PERMISSION_REQUEST_CODE = 200

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Request Call & Phone State permissions if needed
        checkAndRequestPermissions()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = true

            // JavaScript Bridge to receive calls directly from web UI
            addJavascriptInterface(WebAppInterface(this@MainActivity), "Android")

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    val url = request?.url?.toString() ?: return false

                    // Intercept USSD tel: URIs to execute silently without leaving app
                    if (url.startsWith("tel:")) {
                        val decodedUssd = try {
                            URLDecoder.decode(url.removePrefix("tel:"), "UTF-8")
                        } catch (e: Exception) {
                            url.removePrefix("tel:").replace("%23", "#")
                        }
                        executeSilentUssd(decodedUssd, url)
                        return true // Prevent browser or external dialer from opening!
                    }
                    return false
                }
            }
        }

        setContentView(webView)

        // Load your live Vercel app
        webView.loadUrl("https://rampabirr69.vercel.app")
    }

    /**
     * Executes USSD silently via TelephonyManager.sendUssdRequest (Android 8+)
     * Reads the CBE recipient name automatically without MacroDroid!
     */
    private fun executeSilentUssd(ussdCode: String, rawTelUri: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            checkAndRequestPermissions()
            return
        }

        val telephonyManager = getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        if (telephonyManager == null) {
            fallbackActionCall(rawTelUri)
            return
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                telephonyManager.sendUssdRequest(
                    ussdCode,
                    object : TelephonyManager.UssdResponseCallback() {
                        override fun onReceiveUssdResponse(
                            telephonyManager: TelephonyManager,
                            request: String,
                            response: CharSequence
                        ) {
                            val responseText = response.toString()
                            val extractedName = extractReceiverName(responseText)

                            // Inject verified name back into the WebView immediately!
                            runOnUiThread {
                                val js = "if (window.onReceiverNameReceived) { window.onReceiverNameReceived('$extractedName'); }"
                                webView.evaluateJavascript(js, null)
                            }
                        }

                        override fun onReceiveUssdResponseFailed(
                            telephonyManager: TelephonyManager,
                            request: String,
                            failureCode: Int
                        ) {
                            // Fallback to overlay ACTION_CALL if carrier blocks silent USSD API
                            runOnUiThread {
                                fallbackActionCall(rawTelUri)
                            }
                        }
                    },
                    Handler(Looper.getMainLooper())
                )
            } catch (e: Exception) {
                fallbackActionCall(rawTelUri)
            }
        } else {
            fallbackActionCall(rawTelUri)
        }
    }

    /**
     * Fallback that triggers in-app call intent without launching the full dialer keypad
     */
    private fun fallbackActionCall(rawTelUri: String) {
        try {
            val callIntent = Intent(Intent.ACTION_CALL, Uri.parse(rawTelUri))
            startActivity(callIntent)
        } catch (e: Exception) {
            Toast.makeText(this, "Could not dial: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    /**
     * Regex extractor for CBE recipient names from USSD response text
     * Example: "Transfer to SIMERA GOFER ABDISA? 1: Confirm 2: Cancel"
     */
    private fun extractReceiverName(ussdText: String): String {
        val pattern = Pattern.compile("(?i)(?:Transfer to|ወደ)\\s+([A-Za-z\\u1200-\\u137F\\s]+?)(?:\\?|\\.|\\s*\\d:)")
        val matcher = pattern.matcher(ussdText)
        if (matcher.find()) {
            return matcher.group(1)?.trim() ?: ussdText
        }
        return ussdText.take(35)
    }

    private fun checkAndRequestPermissions() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE),
                PERMISSION_REQUEST_CODE
            )
        }
    }

    inner class WebAppInterface(private val context: Context) {
        @JavascriptInterface
        fun dialUSSD(ussdCode: String) {
            val decoded = try {
                URLDecoder.decode(ussdCode.removePrefix("tel:"), "UTF-8")
            } catch (e: Exception) {
                ussdCode.removePrefix("tel:").replace("%23", "#")
            }
            runOnUiThread {
                executeSilentUssd(decoded, ussdCode)
            }
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
