package com.appupdates

import com.facebook.react.bridge.ReactApplicationContext

class AppUpdatesModule(reactContext: ReactApplicationContext) :
  NativeAppUpdatesSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeAppUpdatesSpec.NAME
  }
}
