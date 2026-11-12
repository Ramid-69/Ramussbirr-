package com.ramid.messages

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity

class ComposeSmsActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val forwardIntent = Intent(this, MainActivity::class.java).apply {
            action = intent.action
            data = intent.data
            putExtras(intent)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        startActivity(forwardIntent)
        finish()
    }
}
