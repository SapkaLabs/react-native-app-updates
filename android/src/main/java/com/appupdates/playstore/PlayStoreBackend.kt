package com.appupdates.playstore

import com.facebook.react.bridge.Promise

internal interface PlayStoreBackend {
  fun getPlayUpdateInfo(promise: Promise)
  fun invalidate()
  fun startPlayUpdate(flow: String, resumeInProgress: Boolean, promise: Promise)
}
