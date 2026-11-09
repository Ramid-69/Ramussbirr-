package com.samsung.messages.cbe;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

public class ComposeActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = getIntent();
        Intent mainIntent = new Intent(this, MainActivity.class);
        if (intent != null && intent.getData() != null) {
            mainIntent.setData(intent.getData());
        }
        startActivity(mainIntent);
        finish();
    }
}
