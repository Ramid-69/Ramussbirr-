-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.cbebirr.messages.cbe.** { *; }
-dontwarn **
