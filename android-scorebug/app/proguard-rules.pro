# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.baseball.scorebug.GameState { *; }
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# Gson
-keep class com.google.gson.** { *; }
